document.addEventListener('DOMContentLoaded', () => {
    const descriptionBox = document.getElementById('description-box');

    document.getElementById('about-link').addEventListener('click', () => {
        showDescription('About Me: Learn more about who I am and my background.');
    });

    document.getElementById('projects-link').addEventListener('click', () => {
        showDescription('Projects: Explore the projects I have worked on and their details.');
    });

    document.getElementById('education-link').addEventListener('click', () => {
        showDescription('Education: Find out about my academic background and courses.');
    });

    document.getElementById('contact-link').addEventListener('click', () => {
        showDescription('Contact: Get in touch with me through email.');
    });

    function showDescription(text) {
        descriptionBox.textContent = text;
        descriptionBox.classList.remove('hidden');
        setTimeout(() => {
            descriptionBox.classList.add('hidden');
        }, 3000);
    }
});
