export class WebhookAlerter {
  constructor(fetcher = fetch) {
    this.fetcher = fetcher;
  }

  async send(url, payload) {
    if (!url) {
      return;
    }

    await this.fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
}
