import { VideoData } from "./types.js";
import Tab = browser.tabs.Tab;

// @ts-ignore
async function init() {
    // Check YouTube tabs when extension is loaded
    checkYouTubeTabs();
}

async function getStorage(): Promise<{ [key: string]: VideoData }> {
    return (await browser.storage.local.get('videoDataStorage')).videoDataStorage ?? {};
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check all YouTube tabs
async function checkYouTubeTabs() {
    console.log('Gathering youtube tabs');
    const videoDataStorage = await getStorage();
    let tabs = await browser.tabs.query({});
    let urls = tabs.map(tab => tab.url);

    for (const key in videoDataStorage) {
        if (!urls.includes(key)) {
            console.log('Removing ' + key);
            delete videoDataStorage[key];
        }
    }

    const promises: Promise<void>[] = [];
    for (let tab of tabs) {
        if (tab.url) {
            if (tab.url.includes('youtube.com/watch')) {
                promises.push(new Promise(async (resolve, reject) => {
                    const tabDiscarded = tab.discarded;
                    if (tabDiscarded) {
                        if (tab.url in videoDataStorage) {
                            resolve();
                            return;
                        }

                        await waitForTabReady(tab.id);
                    }

                    const data = await updateTab(tab);
                    if (data) {
                        videoDataStorage[data[0]] = data[1];
                    }
                    await browser.storage.local.set({'videoDataStorage': videoDataStorage});
                    if (tabDiscarded) {
                        browser.tabs.discard(tab.id);
                    }
                    resolve();
                }));
            }
        }
    }

    await Promise.all(promises);
    await browser.storage.local.set({'videoDataStorage': videoDataStorage});
}

// browser.tabs.onActivated.addListener(async (activeInfo) => {
//     let tab = await browser.tabs.get(activeInfo.tabId);
//     let previousTab = await browser.tabs.get(activeInfo.previousTabId);
//     if (previousTab.url.includes('youtube.com/watch') && previousTab.url in (await getStorage())) {
//         console.log('Updating ' + previousTab.url);
//         await updateTab(previousTab);
//     }
// });

// browser.tabs.onMoved.addListener(async (tabId, moveInfo) => {
//     let tab = await browser.tabs.get(tabId);
//     if (tab.url.includes('youtube.com/watch') && tab.url in (await getStorage())) {
//         console.log('Updating ' + tab.url);
//         await updateTab(tab);
//     }
// })

browser.runtime.onMessage.addListener(async (message: any) => {
    console.log('Message ', message);
    if (message.doUpdate) {
        await checkYouTubeTabs();
    }

    return true;
})

// Display video data when button is clicked
// browser.browserAction.onClicked.addListener(() => {
//     console.log(videoDataStorage);
// });

async function updateTab(tab: Tab): Promise<[string, VideoData] | undefined>
{
    try {
        const [timeWatched, totalDuration, title] = (await browser.tabs.executeScript(tab.id, {file: 'src/youtube.js'}))[0];
        let timeWatchedNumber = stringToSecondsWatched(timeWatched);
        let totalDurationNumber = stringToSecondsWatched(totalDuration);
        let percentage = timeWatchedNumber/totalDurationNumber*100;
        const youtubeId = tab.url.match(/(?<=\d\/|\.be\/|v[=\/])([\w\-]{11,})|^([\w\-]{11})$/)?.[1];
        const tabUrl = tab.url;
        const data = new VideoData(timeWatched, totalDuration, title, percentage, youtubeId);
        console.log(data);
        return [tabUrl, data]
    } catch (error) {
        console.error(error, tab);
        return undefined;
    }
}

function stringToSecondsWatched(value: string): number
{
    let split = value.split(':').reverse();
    let seconds = parseInt(split[0]);
    let minutes = parseInt(split[1]);
    let hours = split[2] ? parseInt(split[2]) : 0;

    return seconds + (minutes * 60) + (hours * 3600);
}

function waitForTabReady(tabId: number): Promise<browser.tabs.Tab> {
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            browser.tabs.onUpdated.removeListener(listener);
            reject(new Error("Tab took too long to finish loading"));
        }, 30000); // 30 seconds max


        const listener = (updatedTabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo, tab: browser.tabs.Tab) => {
            if (updatedTabId === tabId && changeInfo.status === "complete") {
                clearTimeout(timeout);
                browser.tabs.onUpdated.removeListener(listener);

                if (!tab.url || !tab.url.startsWith("http")) {
                    return reject(new Error("Tab has invalid or restricted URL: " + tab.url));
                }

                resolve(tab);
            }
        };

        browser.tabs.onUpdated.addListener(listener);
        await browser.tabs.reload(tabId);
    });
}

init();
