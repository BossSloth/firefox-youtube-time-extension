import { VideoData } from "./types.js";

let searching = false;

// @ts-ignore
async function init() {
    document.getElementById('refresh').addEventListener('click', () => refresh());
    document.getElementById('search').addEventListener('input', () => {
        if (!searching) {
            searching = true;
            init();
        }
    });

    let videoDataStorage: Record<string, VideoData> = await getStorage();
    let videoDataStorageValues = Object.values(videoDataStorage);
    videoDataStorageValues.sort((a, b): number => {
        return calculateTimeLeft(a) - calculateTimeLeft(b);
    })

    let lists = document.querySelector('#list');
    while(lists.children[1]) {
        lists.removeChild(lists.children[1]);
    }
    let templateListItem = lists.firstElementChild;

    for (const videoData of videoDataStorageValues) {
        let listItem = templateListItem.cloneNode(true) as HTMLElement;
        listItem.classList.remove('d-none');
        listItem.querySelector('#title').textContent = videoData.title;
        listItem.querySelector('#start-time').textContent = videoData.timeWatched.toString();
        listItem.querySelector('#end-time').textContent = videoData.totalDuration.toString();
        listItem.querySelector('#left').textContent = secondsToFormattedString(calculateTimeLeft(videoData));
        listItem.querySelector('#progress-bar').setAttribute('style', 'width: ' + videoData.percentageWatched + '%');
        listItem.querySelector('#openTab').addEventListener('click', async () => {
            const validTabs = await browser.tabs.query({url: `*://www.youtube.com/*${videoData.youtubeId}*`})
            console.log(validTabs);
            if (validTabs.length > 0) {
                browser.tabs.update(validTabs[0].id, {active: true})
            }
        })

        lists.appendChild(listItem)
    }

    searching = false;
}

browser.storage.local.onChanged.addListener(() => {
    init();
})

async function refresh(): Promise<void>
{
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'block';
    await browser.runtime.sendMessage({doUpdate: true});
    spinner.style.display = 'none';
    init();
}

function calculateTimeLeft(data: VideoData): number
{
    return (stringToSecondsWatcheds(data.totalDuration) - stringToSecondsWatcheds(data.timeWatched));
}

async function getStorage(): Promise<Record<string, VideoData>> {
    const storage = (await browser.storage.local.get('videoDataStorage') as { videoDataStorage: Record<string, VideoData> }).videoDataStorage ?? {};

    const searchValue = (document.getElementById('search') as HTMLInputElement)?.value;
    if (searchValue) {
        const filteredStorage: Record<string, VideoData> = {};
        for (const key in storage) {
            if (storage[key].title.toLowerCase().includes(searchValue.toLowerCase())) {
                filteredStorage[key] = storage[key];
            }
        }
        return filteredStorage;

    }

    return storage;
}

function stringToSecondsWatcheds(value: string): number
{
    let split = value.split(':').reverse();
    let seconds = parseInt(split[0]);
    let minutes = parseInt(split[1]);
    let hours = split[2] ? parseInt(split[2]) : 0;

    return seconds + (minutes * 60) + (hours * 3600);
}

function secondsToFormattedString(seconds: number): string {
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds - (hours * 3600)) / 60);
    let remainingSeconds = seconds - (hours * 3600) - (minutes * 60);

    let hoursString = hours < 10 ? '0' + hours : hours;
    let minutesString = minutes < 10 ? '0' + minutes : minutes;
    let secondsString = remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds;

    return hoursString + ':' + minutesString + ':' + secondsString;
}

init();