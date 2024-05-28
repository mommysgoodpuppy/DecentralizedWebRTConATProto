// deno-lint-ignore-file

// puppeteer_bridge.ts

import puppeteer from "https://raw.githubusercontent.com/mommysgoodpuppy/puppeteer_plus/main/mod.ts";

export async function startBrowser() {
    const browser = await puppeteer.launch({
        headless: true,
        handleSIGHUP: false,
        handleSIGINT: false,
    });
    const page = await browser.newPage();
    await page.goto(`file://${Deno.cwd()}/webrtc.html`);
    return { browser, page };
}

export async function sendOfferSDP(page: puppeteer.Page, offerSDP: any) {
    await page.evaluate((offerSDP) => {
        const signalingChannel = new WebSocket('ws://localhost:8000');
        signalingChannel.onopen = () => {
            signalingChannel.send(JSON.stringify({ sdp: offerSDP }));
        };
        window.signalingChannel = signalingChannel;
    }, offerSDP);
}

export async function sendIceCandidates(page: puppeteer.Page, candidates: any[]) {
    for (const candidate of candidates) {
        await page.evaluate((candidate) => {
            window.signalingChannel.send(JSON.stringify({ candidate }));
        }, candidate);
    }
}

export function extractSDP(record: any, type: 'offer' | 'answer') {
    const prefix = type === 'offer' ? 'Offer SDP: ' : 'Answer SDP: ';
    if (record && record.text && record.text.startsWith(prefix)) {
        return JSON.parse(record.text.replace(prefix, ''));
    }
    throw new Error(`${type} SDP not found in the record`);
}

export function extractCandidate(record: any) {
    const prefix = 'ICE Candidate: ';
    if (record && record.text && record.text.startsWith(prefix)) {
        return JSON.parse(record.text.replace(prefix, ''));
    }
    throw new Error('ICE Candidate not found in the record');
}
