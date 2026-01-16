export class VideoData {
  constructor(
    public timeWatched: string,
    public totalDuration: string,
    public title: string,
    public percentageWatched: number,
    public youtubeId: string,
  ) {}
}