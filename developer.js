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
    const adminStats = document.getElementById('adminStats');
    const accountSearch = document.getElementById('accountSearch');
    const accountFilter = document.getElementById('accountFilter');
    const accountSort = document.getElementById('accountSort');
    const feedbackSearch = document.getElementById('feedbackSearch');
    const feedbackTypeFilter = document.getElementById('feedbackTypeFilter');
    const feedbackStatusFilter = document.getElementById('feedbackStatusFilter');

    const feedbackStatuses = [
        ['new', 'Nové'],
        ['reviewing', 'Řeší se'],
        ['resolved', 'Vyřešeno'],
        ['declined', 'Zamítnuto']
    ];

    function renderStats() {
        const accounts = window.CasinoApp.managedAccounts();
        const entries = window.CasinoApp.managedFeedback();
        const totalCredits = accounts.reduce((sum, account) => {
            if (!Number.isSafeInteger(account.balance) || account.balance < 0) return sum;
            return sum + BigInt(account.balance);
        }, 0n);
        const stats = [
            ['Účty celkem', accounts.length.toLocaleString('cs-CZ')],
            ['Aktivní účty', accounts.filter((account) => account.disabled !== true).length.toLocaleString('cs-CZ')],
            ['Zablokované účty', accounts.filter((account) => account.disabled === true).length.toLocaleString('cs-CZ')],
            ['Kredity v účtech', totalCredits.toLocaleString('cs-CZ')],
            ['Nové zprávy z posledních 200', entries.filter((entry) => entry.status === 'new').length.toLocaleString('cs-CZ')]
        ];
        adminStats.replaceChildren();
        stats.forEach(([label, value]) => {
            const card = document.createElement('article');
            card.className = 'admin-stat-card';
            const number = document.createElement('strong');
            number.textContent = value;
            const caption = document.createElement('span');
            caption.textContent = label;
            card.append(number, caption);
            adminStats.append(card);
        });
    }

    function filterFeedback(entries) {
        const search = feedbackSearch.value.trim().toLocaleLowerCase('cs-CZ');
        const type = feedbackTypeFilter.value;
        const status = feedbackStatusFilter.value;
        return entries.filter((entry) => {
            const matchesType = type === 'all' || entry.type === type;
            const matchesStatus = status === 'all' || entry.status === status;
            const searchable = `${entry.title} ${entry.details} ${entry.name}`.toLocaleLowerCase('cs-CZ');
            return matchesType && matchesStatus && (!search || searchable.includes(search));
        });
    }

    function renderFeedback() {
        feedbackList.replaceChildren();
        const entries = filterFeedback(window.CasinoApp.managedFeedback());
        if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            const hasFilters = feedbackSearch.value || feedbackTypeFilter.value !== 'all' ||
                feedbackStatusFilter.value !== 'all';
            empty.textContent = hasFilters
                ? 'Žádné zprávy neodpovídají zvolenému filtru.'
                : 'Zatím nebyla odeslána žádná hlášení ani návrhy.';
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

    function filteredAccounts() {
        const search = accountSearch.value.trim().toLocaleLowerCase('cs-CZ');
        const filter = accountFilter.value;
        const sort = accountSort.value;
        return window.CasinoApp.managedAccounts()
            .filter((account) => {
                const matchesStatus = filter === 'all' ||
                    (filter === 'disabled' ? account.disabled === true : account.disabled !== true);
                const searchable = `${account.name} ${account.email}`.toLocaleLowerCase('cs-CZ');
                return matchesStatus && (!search || searchable.includes(search));
            })
            .sort((first, second) => {
                if (sort === 'name') return first.name.localeCompare(second.name, 'cs');
                if (sort === 'created') {
                    const firstDate = first.createdAt?.toMillis?.() || 0;
                    const secondDate = second.createdAt?.toMillis?.() || 0;
                    return secondDate - firstDate;
                }
                return second.balance - first.balance;
            });
    }

    function renderAccounts() {
        accountList.replaceChildren();
        const accounts = filteredAccounts();
        if (!accounts.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            const hasFilters = accountSearch.value || accountFilter.value !== 'all';
            empty.textContent = hasFilters
                ? 'Žádné účty neodpovídají zvolenému vyhledávání nebo filtru.'
                : 'Zatím nejsou vytvořené žádné účty hráčů.';
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
            [
                [-100, '−100 kreditů'],
                [100, '+100 kreditů'],
                [1000, '+1 000 kreditů']
            ].forEach(([amount, text]) => {
                const adjustButton = document.createElement('button');
                adjustButton.type = 'button';
                adjustButton.className = 'button-secondary';
                adjustButton.textContent = text;
                adjustButton.addEventListener('click', async () => {
                    adjustButton.disabled = true;
                    try {
                        await window.CasinoApp.adjustManagedBalance(account.id, amount);
                    } finally {
                        adjustButton.disabled = false;
                    }
                });
                actions.append(adjustButton);
            });
            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.textContent = 'Uložit změny';
            actions.append(saveButton);
            form.append(actions);
            accountList.append(form);
        });
    }

    function exportAccounts() {
        const accounts = window.CasinoApp.managedAccounts();
        const escapeCell = (value) => {
            let text = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
            return `"${text.replaceAll('"', '""')}"`;
        };
        const rows = [
            ['Jméno', 'E-mail', 'Kredity', 'Stav účtu', 'Registrace'],
            ...accounts.map((account) => [
                account.name,
                account.email,
                account.balance,
                account.disabled === true ? 'Zablokovaný' : 'Aktivní',
                account.createdAt?.toDate?.().toISOString() || ''
            ])
        ];
        const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `casino-ucty-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    [accountSearch, accountFilter, accountSort].forEach((control) => {
        control.addEventListener(control === accountSearch ? 'input' : 'change', renderAccounts);
    });
    [feedbackSearch, feedbackTypeFilter, feedbackStatusFilter].forEach((control) => {
        control.addEventListener(control === feedbackSearch ? 'input' : 'change', renderFeedback);
    });
    document.getElementById('exportAccounts').addEventListener('click', exportAccounts);
    document.addEventListener('casino:feedback-changed', () => {
        renderStats();
        renderFeedback();
    });
    document.addEventListener('casino:accounts-changed', () => {
        renderStats();
        renderAccounts();
    });
    renderStats();
    renderFeedback();
    renderAccounts();
})().catch((error) => {
    console.error('Nepodařilo se otevřít správu účtů.', error);
    window.CasinoApp.notify('Správa účtů se nenačetla. Zkontrolujte přihlášení a pravidla Firebase.');
});
