import ReconnectSocket from './ReconnectSocket.js';

class Remote extends ReconnectSocket {
	constructor(url, parameter, lenti, lens) {
		super(url, { onClose: () => this.id = -1 });
		this.id = -1;

		Object.assign(this.messages, {
			id: data => {
				this.id = parseInt(data.value);
				this.send({
					command: 'regist',
					place: parameter.place,
					id: this.id,
				});
			},
			calibration: data => {
				Object.keys(data.value)
					.forEach(x => lens[x] += parseFloat(data.value[x]));
				lenti.calibration(lens);
			},
		});
	}
}

export default Remote;

