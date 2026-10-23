(async function () {
    await window.CasinoApp.ready;
    if (!window.CasinoApp.isDeveloper()) {
        window.CasinoApp.notify('Pro vstup do správy se přihlaste správcovským účtem root.');
        window.setTimeout(() => {
            window.location.replace('index.html');
        }, 1400);
        return;
    }

    const accountList = document.getElementById('accountList');
    const feedbackList = document.getElementById('feedbackList');

    const feedbackStatuses = [
        ['new', 'Nové'],
        ['reviewing', 'Řeší se'],
        ['resolved', 'Vyřešeno'],
        ['declined', 'Zamítnuto']
    ];

    function renderFeedback() {
        feedbackList.replaceChildren();
        const entries = window.CasinoApp.managedFeedback();
        if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            empty.textContent = 'Zatím nebyla odeslána žádná hlášení ani návrhy.';
            feedbackList.append(empty);
            return;
        }

        entries.forEach((entry) => {
            const card = document.createElement('article');
            card.className = 'managed-feedback-card';
            const heading = document.createElement('h3');
            heading.textContent = entry.title;
            const meta = document.createElement('p');
            meta.className = 'feedback-meta';
            const type = entry.type === 'bug' ? 'Hlášení chyby' : 'Návrh na vylepšení';
            const date = entry.createdAt && typeof entry.createdAt.toDate === 'function'
                ? entry.createdAt.toDate().toLocaleString('cs-CZ')
                : 'Datum se načítá';
            meta.textContent = `${type} · ${entry.name} · ${date}`;
            const details = document.createElement('p');
            details.className = 'feedback-details';
            details.textContent = entry.details;

            const form = document.createElement('form');
            form.className = 'feedback-status-form';
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const button = form.querySelector('button');
                button.disabled = true;
                try {
                    await window.CasinoApp.updateFeedbackStatus(
                        entry.id,
                        new FormData(form).get('status')
                    );
                } finally {
                    button.disabled = false;
                }
            });
            const label = document.createElement('label');
            label.textContent = 'Stav';
            const select = document.createElement('select');
            select.name = 'status';
            select.setAttribute('aria-label', `Stav zprávy: ${entry.title}`);
            feedbackStatuses.forEach(([value, text]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                select.append(option);
            });
            select.value = entry.status;
            label.append(select);
            const save = document.createElement('button');
            save.type = 'submit';
            save.textContent = 'Uložit stav';
            form.append(label, save);
            card.append(heading, meta, details, form);
            feedbackList.append(card);
        });
    }

    function renderAccounts() {
        accountList.replaceChildren();
        const accounts = window.CasinoApp.managedAccounts();
        if (!accounts.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            empty.textContent = 'Zatím nejsou vytvořené žádné účty hráčů.';
            accountList.append(empty);
            return;
        }

        accounts.forEach((account) => {
            const form = document.createElement('form');
            form.className = 'managed-account';
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const fields = new FormData(form);
                await window.CasinoApp.updateManagedAccount(account.id, {
                    name: fields.get('name'),
                    balance: Number(fields.get('balance')),
                    disabled: fields.get('disabled') === 'on'
                });
            });

            const heading = document.createElement('h3');
            heading.textContent = account.name;
            form.append(heading);

            const emailLabel = document.createElement('span');
            emailLabel.className = 'readonly-field';
            emailLabel.textContent = 'E-mail';
            const email = document.createElement('span');
            email.textContent = account.email;
            emailLabel.append(email);
            form.append(emailLabel);

            [
                ['Herní jméno', 'name', account.name, 'text'],
                ['Kredity', 'balance', String(account.balance), 'number']
            ].forEach(([labelText, fieldName, value, type]) => {
                const label = document.createElement('label');
                label.textContent = labelText;
                const input = document.createElement('input');
                input.type = type;
                input.name = fieldName;
                input.value = value;
                input.required = true;
                if (fieldName === 'name') input.maxLength = 24;
                if (fieldName === 'balance') {
                    input.min = '0';
                    input.step = '1';
                }
                label.append(input);
                form.append(label);
            });

            const disabledLabel = document.createElement('label');
            disabledLabel.className = 'checkbox-field';
            const disabled = document.createElement('input');
            disabled.type = 'checkbox';
            disabled.name = 'disabled';
            disabled.checked = account.disabled === true;
            const disabledText = document.createElement('span');
            disabledText.textContent = 'Zablokovaný účet';
            disabledLabel.append(disabled, disabledText);
            form.append(disabledLabel);

            const actions = document.createElement('div');
            actions.className = 'managed-account-actions';
            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.textContent = 'Uložit změny';
            actions.append(saveButton);
            form.append(actions);
            accountList.append(form);
        });
    }

    document.addEventListener('casino:feedback-changed', renderFeedback);
    document.addEventListener('casino:accounts-changed', renderAccounts);
    renderFeedback();
    renderAccounts();
})().catch((error) => {
    console.error('Nepodařilo se otevřít správu účtů.', error);
    window.CasinoApp.notify('Správa účtů se nenačetla. Zkontrolujte přihlášení a pravidla Firebase.');
});
