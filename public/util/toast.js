/**
 * トーストを表示する
 * @param {string} - 表示する文字列
 */
export default text => {
	const toast = document.createElement('pre');
	Object.assign(toast.style, {
		display: 'fixed',
		position: 'absolute',
		left: '50%',
		bottom: '5vh',
		margin: '0 auto',
		padding: '0.3em',
		borderRadius: '0.3em',
		backgroundColor: '#aaa',
		color: '#222',
		textAlign: 'center',
		transform: 'translateX(-50%)',
	});
	toast.innerText = text;
	document.body.appendChild(toast);

	setTimeout(() => document.body.removeChild(toast), 5000);
}
