import { BskyAgent } from "npm:@atproto/api"

const agent = new BskyAgent({ service: 'https://bsky.social' })

await agent.login({
    identifier: "",
    password: ""
})

await agent.post({
    text: 'Hello world! I posted this via the API.',
    createdAt: new Date().toISOString()
})