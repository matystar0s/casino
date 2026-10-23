(async function () {
    await window.CasinoApp.ready;
    const form = document.getElementById('feedbackForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        const fields = new FormData(form);
        submitButton.disabled = true;
        try {
            const submitted = await window.CasinoApp.submitFeedback(
                fields.get('type'),
                fields.get('title'),
                fields.get('details')
            );
            if (submitted) form.reset();
        } finally {
            submitButton.disabled = false;
        }
    });
})().catch((error) => {
    console.error('Formulář pro hlášení a návrhy se nenačetl.', error);
    window.CasinoApp.notify('Formulář zpráv není dostupný. Obnovte stránku a zkuste to znovu.');
});
