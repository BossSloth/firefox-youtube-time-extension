export function stringToSeconds(value: string): number {
    const split = value.split(':').reverse();
    const seconds = parseInt(split[0] ?? '0', 10) || 0;
    const minutes = parseInt(split[1] ?? '0', 10) || 0;
    const hours = split[2] ? parseInt(split[2], 10) || 0 : 0;

    return seconds + minutes * 60 + hours * 3600;
}
