import type { VideoData } from "./types.js";

let searching = false;

async function init(): Promise<void> {
    const videoDataStorage: Record<string, VideoData> = await getStorage();
    const videoDataStorageValues = Object.values(videoDataStorage);
    videoDataStorageValues.sort((a, b): number => {
        return calculateTimeLeft(a) - calculateTimeLeft(b);
    });

    const listElement = document.querySelector<HTMLUListElement>('#list');
    if (!listElement) {
        return;
    }

    while (listElement.children.length > 1 && listElement.lastElementChild) {
        listElement.removeChild(listElement.lastElementChild);
    }

    const templateListItem = listElement.firstElementChild as HTMLElement | null;
    if (!templateListItem) {
        return;
    }

    for (const videoData of videoDataStorageValues) {
        const listItem = templateListItem.cloneNode(true) as HTMLElement;
        listItem.classList.remove('d-none');

        const titleEl = listItem.querySelector('#title');
        if (titleEl) {
            titleEl.textContent = videoData.title;
        }

        const startTimeEl = listItem.querySelector('#start-time');
        if (startTimeEl) {
            startTimeEl.textContent = videoData.timeWatched;
        }

        const endTimeEl = listItem.querySelector('#end-time');
        if (endTimeEl) {
            endTimeEl.textContent = videoData.totalDuration;
        }

        const leftEl = listItem.querySelector('#left');
        if (leftEl) {
            leftEl.textContent = secondsToFormattedString(calculateTimeLeft(videoData));
        }

        const progressBarEl = listItem.querySelector<HTMLElement>('#progress-bar');
        if (progressBarEl) {
            progressBarEl.style.width = `${videoData.percentageWatched}%`;
        }

        const openTabButton = listItem.querySelector('#openTab');
        if (openTabButton) {
            openTabButton.addEventListener('click', async () => {
                const validTabs = await browser.tabs.query({ url: `*://*.youtube.com/*${videoData.youtubeId}*` });
                const firstTab = validTabs[0];
                if (firstTab && typeof firstTab.id === 'number') {
                    await browser.tabs.update(firstTab.id, { active: true });
                }
            });
        }

        listElement.appendChild(listItem);
    }

    searching = false;
}

function setupEventListeners(): void {
    const refreshBtn = document.getElementById('refresh');
    refreshBtn?.addEventListener('click', () => {
        void refresh();
    });

    const searchInput = document.getElementById('search');
    searchInput?.addEventListener('input', () => {
        if (!searching) {
            searching = true;
            void init();
        }
    });

    browser.storage.local.onChanged.addListener(() => {
        void init();
    });
}

async function refresh(): Promise<void> {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.style.display = 'block';
    }
    await browser.runtime.sendMessage({ doUpdate: true });
    if (spinner) {
        spinner.style.display = 'none';
    }
    await init();
}

function calculateTimeLeft(data: VideoData): number {
    return stringToSeconds(data.totalDuration) - stringToSeconds(data.timeWatched);
}

async function getStorage(): Promise<Record<string, VideoData>> {
    const result = await browser.storage.local.get('videoDataStorage');
    const storage = (result as { videoDataStorage?: Record<string, VideoData> }).videoDataStorage ?? {};

    const searchValue = (document.getElementById('search') as HTMLInputElement | null)?.value;
    if (searchValue) {
        const query = searchValue.toLowerCase();
        const filteredStorage: Record<string, VideoData> = {};
        for (const [key, value] of Object.entries(storage)) {
            if (value.title.toLowerCase().includes(query)) {
                filteredStorage[key] = value;
            }
        }
        return filteredStorage;
    }

    return storage;
}

function stringToSeconds(value: string): number {
    const split = value.split(':').reverse();
    const seconds = parseInt(split[0] ?? '0', 10) || 0;
    const minutes = parseInt(split[1] ?? '0', 10) || 0;
    const hours = split[2] ? parseInt(split[2], 10) || 0 : 0;

    return seconds + (minutes * 60) + (hours * 3600);
}

function secondsToFormattedString(seconds: number): string {
    const safeSeconds = Math.max(0, seconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    const hoursString = String(hours).padStart(2, '0');
    const minutesString = String(minutes).padStart(2, '0');
    const secondsString = String(remainingSeconds).padStart(2, '0');

    return `${hoursString}:${minutesString}:${secondsString}`;
}

setupEventListeners();
void init();