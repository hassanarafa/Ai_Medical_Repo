const imageInput = document.getElementById('image');
const imageName = document.getElementById('imageName');
const preview = document.getElementById('preview');
const previewEmpty = document.getElementById('previewEmpty');

if (imageInput) {
	imageInput.addEventListener('change', () => {
		const file = imageInput.files && imageInput.files[0];

		if (!file) {
			imageName.textContent = 'No file selected';
			preview.classList.add('hidden');
			preview.removeAttribute('src');
			previewEmpty.classList.remove('hidden');
			return;
		}

		imageName.textContent = file.name;
		const fileUrl = URL.createObjectURL(file);
		preview.src = fileUrl;
		preview.classList.remove('hidden');
		previewEmpty.classList.add('hidden');
	});
}

const buttons = document.querySelectorAll('.choice-btn');

buttons.forEach((btn) => {
	btn.addEventListener('click', () => {
		const field = btn.getAttribute('data-field');
		const value = btn.getAttribute('data-value');
		const input = document.getElementById(field);

		if (!input) return;

		input.value = value;

		const siblingButtons = document.querySelectorAll(`.choice-btn[data-field="${field}"]`);
		siblingButtons.forEach((sibling) => {
			sibling.classList.remove('ring-2', 'ring-cyan-300', 'bg-cyan-500/20', 'text-cyan-100');
		});

		btn.classList.add('ring-2', 'ring-cyan-300', 'bg-cyan-500/20', 'text-cyan-100');
	});
});
