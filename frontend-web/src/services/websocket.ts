type WebSocketCallback = (event: string, payload: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: WebSocketCallback[] = [];
  private reconnectInterval = 3000;
  private isConnected = false;

  public connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // Server attaches WebSocket to port 3000
    const wsUrl = `${protocol}//${host}:3000`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notify('STATUS_CHANGE', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data.type, data.payload);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notify('STATUS_CHANGE', { connected: false });
        setTimeout(() => this.connect(), this.reconnectInterval);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  public subscribe(callback: WebSocketCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify(event: string, payload: any) {
    this.listeners.forEach((cb) => cb(event, payload));
  }

  public getStatus() {
    return this.isConnected;
  }
}

export const wsClient = new WebSocketClient();
