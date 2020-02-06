import ReconnectSocket from './ReconnectSocket.js';

import Toast from './toast.js';

class Remote extends ReconnectSocket {
	constructor(url, parameter, lenti, lens, image) {
		let id = -1;
		super(url, { onClose: () => id = -1 });

		let place = parameter.place;

		const regist = () => this.send('regist', { place, id });

		Object.assign(this.messages, {
			id: data => {
				id = parseInt(data.value);
				regist();
			},
			reregist: regist,
			reload: () => { location.reload(); },
			calibration: data => {
				Object.keys(data.value)
					.forEach(x => lens[x] += parseFloat(data.value[x]));
				lenti.calibration(lens);
			},
			ping: () => {
				Toast('Pong');
			},
			place: data => {
				place = data.value;
				regist();
			},
			show: data => {
				fetch(`http://10.18.174.86:32281/image/${data.value}/${place.join(',')}.png`)
					.then(res => {
						if (res.status >= 300 || res.status < 200) throw Error(`Error: ${res.status}`);
						return res.blob();
					})
					.then(blob => {
						const reader = new FileReader();
						reader.onloadend = () => {
							const image = document.querySelector('#image');
							image.src = reader.result;
							image.style.display = 'block';
						};
						reader.readAsDataURL(blob);
						return true;
					})
					.catch(err => console.log(err));
			},
			hide: () => {
				document.querySelector('#image').style.display = 'none';
			},
		});
	}
}

export default Remote;

