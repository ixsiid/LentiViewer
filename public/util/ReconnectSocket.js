class ReconnectSocket {
	constructor(url, callback) {
		Object.defineProperty(this, 'messages', {
			enumerable: false,
			configurable: false,
			writable: false,
			value: {},
		});

		Object.defineProperty(this, 'url', {
			enumerable: false,
			configurable: false,
			writable: false,
			value: url,
		});
		Object.defineProperty(this, 'callback', {
			enumerable: false,
			configurable: false,
			writable: false,
			value: callback,
		});
		Object.defineProperty(this, 'socket', {
			enumerable: false,
			configurable: false,
			writable: true,
			value: false,
		});

		this.connect();
	}

	onMessage(event) {
		const data = JSON.parse(event.data);
		const proc = Object.keys(this.messages).find(x => x == data.command);
		if (proc) this.messages[proc](data);
		else console.log(`Unknown message: ${event.data}`);
	}

	connect() {
		this.socket = new WebSocket(this.url);
		this.socket.addEventListener('error', () => setTimeout(() => this.connect(), 5000));
		this.socket.addEventListener('open', () => {
			if (this.callback.onOpen) this.callback.onOpen();

			this.socket.addEventListener('close', () => {
				if (this.callback.onClose) this.callback.onClose();
				this.connect();
			});
			this.socket.addEventListener('message', event => this.onMessage(event));
		});
	}

	send(command, params) {
		this.socket.send(JSON.stringify(Object.assign({ command }, params)));
	}
}


export default ReconnectSocket;