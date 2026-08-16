import type { VideoData } from "./types.js";
import Tab = browser.tabs.Tab;

async function init(): Promise<void> {
    await checkYouTubeTabs();
}

async function getStorage(): Promise<Record<string, VideoData>> {
    const data = await browser.storage.local.get('videoDataStorage');
    return (data as { videoDataStorage?: Record<string, VideoData> }).videoDataStorage ?? {};
}

// Check all YouTube tabs
async function checkYouTubeTabs(): Promise<void> {
    console.log('Gathering youtube tabs');
    const videoDataStorage = await getStorage();
    const tabs = await browser.tabs.query({});
    const urls = tabs.map(tab => tab.url).filter((url): url is string => Boolean(url));

    for (const key in videoDataStorage) {
        if (!urls.includes(key)) {
            console.log('Removing ' + key);
            delete videoDataStorage[key];
        }
    }

    const updates = tabs
        .filter((tab): tab is Tab & { id: number; url: string } => typeof tab.id === 'number' && typeof tab.url === 'string' && tab.url.includes('youtube.com/watch'))
        .map(async (tab) => {
            const tabDiscarded = tab.discarded;
            if (tabDiscarded) {
                if (tab.url in videoDataStorage) {
                    return;
                }

                await waitForTabReady(tab.id);
            }

            const data = await updateTab(tab, true);
            if (data) {
                videoDataStorage[data[0]] = data[1];
            }
            await browser.storage.local.set({ videoDataStorage });
            if (tabDiscarded) {
                await browser.tabs.discard(tab.id);
            }
        });

    await Promise.all(updates);
    await browser.storage.local.set({ videoDataStorage });
}

browser.tabs.onActivated.addListener(async (activeInfo) => {
    if (typeof activeInfo.previousTabId !== 'number') {
        return;
    }
    const previousTab = await browser.tabs.get(activeInfo.previousTabId);
    const storage = await getStorage();
    if (previousTab.url?.includes('youtube.com/watch') && previousTab.url in storage) {
        console.log('Updating ' + previousTab.url);
        const data = await updateTab(previousTab, false);
        if (data) {
            storage[data[0]] = data[1];
            await browser.storage.local.set({ videoDataStorage: storage });
        }
    }
});

browser.runtime.onMessage.addListener(async (message: object) => {
    console.log('Message ', message);
    if ('doUpdate' in message && message.doUpdate) {
        await checkYouTubeTabs();
    }

    return true;
});

async function updateTab(tab: Tab, shouldPause: boolean): Promise<[string, VideoData] | undefined> {
    if (typeof tab.id !== 'number' || !tab.url || !tab.url.includes('youtube.com/watch')) {
        return undefined;
    }
    try {
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: (pause: boolean) => {
                (window as unknown as { shouldPauseVideo?: boolean }).shouldPauseVideo = pause;
            },
            args: [shouldPause]
        });
        const results = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/youtube.js']
        });
        const firstResult = results[0];
        if (!firstResult || !Array.isArray(firstResult.result)) {
            return undefined;
        }
        const [timeWatched, totalDuration, title] = firstResult.result as [string, string, string];
        const timeWatchedNumber = stringToSecondsWatched(timeWatched);
        const totalDurationNumber = stringToSecondsWatched(totalDuration);
        const percentage = totalDurationNumber > 0 ? (timeWatchedNumber / totalDurationNumber) * 100 : 0;
        const youtubeId = tab.url.match(/(?<=\d\/|\.be\/|v[=/])([\w-]{11,})|^([\w-]{11})$/)?.[1] ?? '';
        const tabUrl = tab.url;
        const data: VideoData = {
            timeWatched,
            totalDuration,
            title,
            percentageWatched: percentage,
            youtubeId
        };
        console.log(data);
        return [tabUrl, data];
    } catch (error) {
        console.error(error, tab);
        return undefined;
    }
}

function stringToSecondsWatched(value: string): number {
    const split = value.split(':').reverse();
    const seconds = parseInt(split[0] ?? '0', 10) || 0;
    const minutes = parseInt(split[1] ?? '0', 10) || 0;
    const hours = split[2] ? parseInt(split[2], 10) || 0 : 0;

    return seconds + (minutes * 60) + (hours * 3600);
}

function waitForTabReady(tabId: number): Promise<browser.tabs.Tab> {
    return new Promise((resolve, reject) => {
        let listener: (updatedTabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo, tab: browser.tabs.Tab) => void;

        const timeout = setTimeout(() => {
            browser.tabs.onUpdated.removeListener(listener);
            reject(new Error("Tab took too long to finish loading"));
        }, 30000); // 30 seconds max

        listener = (updatedTabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo, tab: browser.tabs.Tab) => {
            if (updatedTabId === tabId && changeInfo.status === "complete") {
                clearTimeout(timeout);
                browser.tabs.onUpdated.removeListener(listener);

                if (!tab.url || !tab.url.startsWith("http")) {
                    reject(new Error("Tab has invalid or restricted URL: " + tab.url));
                    return;
                }

                resolve(tab);
            }
        };

        browser.tabs.onUpdated.addListener(listener);
        browser.tabs.reload(tabId).catch(reject);
    });
}

init();
