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

    const video = document.querySelector('video');
    const currentTime = document.querySelector('.ytp-time-current');
    const duration = document.querySelector('.ytp-time-duration');

    if (video && (window as any).shouldPauseVideo) {
        video.pause();
    }

    return [
        currentTime?.textContent ?? '0:00',
        duration?.textContent ?? '0:00',
        title
    ];
}

start().then((data) => {
    return data;
})
