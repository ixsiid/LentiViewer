import Toast from './toast.js';

export default (canvas, name) => {
	const link = document.createElement('a');
	link.href = canvas.toDataURL();
	link.download = name || `${new Date().getTime()}.png`;
	link.click();

	Toast('Download to ' + link.download);
}
