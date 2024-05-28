// deno-lint-ignore-file
// webrtc_connector.ts

import { AtpAgent, AtpSessionEvent, AtpSessionData } from "npm:@atproto/api";
import { startBrowser, sendOfferSDP, sendIceCandidates, extractSDP, extractCandidate } from './puppeteer.ts';

export class WebRTCConnector {
    private api: AtpAgent;
    private savedSessionData: AtpSessionData | null = null;
    private username: string;
    private password: string;
    private browser: any;
    private page: any;
    private signalingSocket: WebSocket | null = null;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
        this.api = new AtpAgent({
            service: 'https://bsky.social',
            persistSession: (_evt: AtpSessionEvent, sess?: AtpSessionData) => {
                if (sess) { this.savedSessionData = sess; }
            },
        });
    }

    async login() {
        if (this.savedSessionData !== null) {
            await this.api.resumeSession(this.savedSessionData);
        } else {
            await this.api.login({ identifier: this.username, password: this.password });
        }
    }

    async openConnection(): Promise<{ rkey: string, signalingSocket: WebSocket }> {
        const repo = this.username;
        const collection = 'app.bsky.feed.post';

        await this.login();

        const { browser, page } = await startBrowser();
        this.browser = browser;
        this.page = page;

        const offerSDP = await page.evaluate(async () => {
            const peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            window.peerConnection = peerConnection;

            return offer;
        });

        const record = {
            $type: 'app.bsky.feed.post',
            text: `Offer SDP: ${JSON.stringify(offerSDP)}`,
            createdAt: new Date().toISOString()
        };
        const response = await this.api.com.atproto.repo.createRecord({ repo, collection, record });
        const rkey: string = response.data.uri.split('/').pop();
        console.log(`Offer rkey: ${rkey}`);

        setTimeout(async () => {
            await this.api.com.atproto.repo.deleteRecord({ repo, collection, rkey });
            console.log(`Deleted offer rkey: ${rkey}`);
            await browser.close();
        }, 60000);

        this.signalingSocket = new WebSocket('ws://localhost:8000');
        this.signalingSocket.onopen = () => {
            console.log('Signaling WebSocket connection established');
        };

        return { rkey, signalingSocket: this.signalingSocket };
    }

    async connect(rkey: string): Promise<WebSocket> {
        const repo = this.username;
        const collection = 'app.bsky.feed.post';

        await this.login();

        const { browser, page } = await startBrowser();
        this.browser = browser;
        this.page = page;

        const response = await this.api.com.atproto.repo.getRecord({ repo, collection, rkey });
        const offerRecord = response.data.value;
        const offerSDP = extractSDP(offerRecord, 'offer');

        await page.evaluate(async (offerSDP) => {
            const peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });

            await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSDP));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            window.peerConnection = peerConnection;

            return peerConnection;
        }, offerSDP);

        await sendOfferSDP(page, offerSDP);

        const candidateResponse = await this.api.com.atproto.repo.listRecords({ repo, collection, limit: 50 });
        const candidateRecords = candidateResponse.data.records;

        const candidates = candidateRecords.map((record: any) => extractCandidate(record));
        await sendIceCandidates(page, candidates);

        this.signalingSocket = new WebSocket('ws://localhost:8000');
        this.signalingSocket.onopen = () => {
            console.log('Signaling WebSocket connection established');
        };

        return this.signalingSocket;
    }

    async sendData(data: any) {
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify({ type: 'data', data }));
        } else {
            throw new Error('Signaling socket is not connected');
        }
    }
}