import { WebRTCConnector } from './webrtcconnector.ts';

const username = "";
const password = ""

if (import.meta.main) {
    const connector = new WebRTCConnector(username, password);

    const args = Deno.args;
    if (args[0] === "open") {
        const { rkey, signalingSocket } = await connector.openConnection();
        console.log(`Open connection with rkey: ${rkey}`);
        // Use the signalingSocket object as needed to send/receive data
        // Example: Send data after connection is established
        setTimeout(() => {
            connector.sendData({ message: "Hello from Deno!" });
        }, 5000);
    } else if (args[0] === "connect" && args[1]) {
        const rkey = args[1];
        const signalingSocket = await connector.connect(rkey);
        console.log(`Connected using rkey: ${rkey}`);
        // Use the peerConnection object as needed
    } else {
        console.log("Usage:");
        console.log("  deno run --allow-net --allow-read --allow-write main.ts open");
        console.log("  deno run --allow-net --allow-read --allow-write main.ts connect <rkey>");
    }
}