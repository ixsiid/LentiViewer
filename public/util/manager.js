import ReconnectSocket from './ReconnectSocket.js';

class Manager extends ReconnectSocket {
	constructor(url, callback) {
		super(url, { onClose: () => this.id = -1 });
		this.id = -1;

		Object.assign(this.messages, callback);
	}

	ids() {
		this.send({ command: 'ids' });
	}

	calibration(target, value) {
		this.send({ command: 'calibration', target, value});
	}


}

export default Manager;
