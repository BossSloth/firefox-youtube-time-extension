function waitForElm(selector: string) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

async function start() {
    await waitForElm('.ytp-time-current');
    const title = document.title.split('- YouTube')[0].trim();

    document.querySelector('video').pause()
    return [document.querySelector('.ytp-time-current').textContent, document.querySelector('.ytp-time-duration').textContent, title];
}

start().then((data) => {
    return data;
})
