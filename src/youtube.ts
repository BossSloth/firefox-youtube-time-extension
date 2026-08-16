function waitForElm(selector: string): Promise<Element | null> {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        const observer = new MutationObserver(() => {
            const found = document.querySelector(selector);
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    });
}

async function start() {
    await waitForElm('.ytp-time-current');
    const title = document.title.split('- YouTube')[0]?.trim() ?? '';

    const video = document.querySelector('video');
    const currentTime = document.querySelector('.ytp-time-current');
    const duration = document.querySelector('.ytp-time-duration');

    if (video && (window as unknown as { shouldPauseVideo?: boolean }).shouldPauseVideo) {
        video.pause();
    }

    return [currentTime?.textContent ?? '0:00', duration?.textContent ?? '0:00', title];
}

void start().then((data) => {
    return data;
});
