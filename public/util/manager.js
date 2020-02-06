import ReconnectSocket from './ReconnectSocket.js';

class Manager extends ReconnectSocket {
	constructor(url, callback) {
		super(url, { onClose: () => this.id = -1 });
		this.id = -1;

		Object.assign(this.messages, callback);
	}

	ids() {
		this.send('ids');
	}

	calibration(target, value) {
		this.send('calibration', { target, value });
	}

	images() {
		this.send('images');
	}
}

export default Manager;
