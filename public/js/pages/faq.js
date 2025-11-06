document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach((question) => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isActive = faqItem.classList.contains('active');

            document.querySelectorAll('.faq-item').forEach((item) => {
                item.classList.remove('active');
            });

            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });
});
