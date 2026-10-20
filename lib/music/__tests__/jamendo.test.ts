import { describe, expect, it } from "vitest";
import { fromJamendo, genreLabel, licenseLabel } from "@/lib/music/jamendo";
import { trackArtworkUrl, trackAudioUrl } from "@/lib/music/types";

const raw = {
  id: "1532771",
  name: "Night Drive",
  duration: 214,
  artist_name: "Some Artist",
  album_name: "Late",
  releasedate: "2019-06-14",
  image: "https://usercontent.jamendo.com?type=album&id=1&width=300",
  audio: "https://prod-1.storage.jamendo.com/?trackid=1532771&format=mp31",
  audiodownload: "https://prod-1.storage.jamendo.com/download/track/1532771/mp32/",
  audiodownload_allowed: true,
  shareurl: "https://www.jamendo.com/track/1532771",
  license_ccurl: "http://creativecommons.org/licenses/by-nc-sa/3.0/",
  musicinfo: { tags: { genres: ["hiphop", "electronic"] } },
};

describe("Jamendo", () => {
  it("maps a result to a playable track", () => {
    const t = fromJamendo(raw);
    expect(t).toMatchObject({ id: "jamendo:1532771", title: "Night Drive", artist: "Some Artist", genre: "Hip-Hop", year: 2019, durationSeconds: "214" });
    expect(t.remote).toMatchObject({ jamendoId: "1532771", license: "CC BY-NC-SA", downloadable: true, pageUrl: raw.shareurl });
    expect(trackAudioUrl(t)).toBe(raw.audio);
    expect(trackArtworkUrl(t)).toBe(raw.image);
  });

  it("drops non-https links and odd dates", () => {
    const t = fromJamendo({ ...raw, image: "http://x/a.jpg", album_image: undefined, releasedate: "0000-00-00", audiodownload_allowed: false });
    expect(t.remote?.imageUrl).toBeNull();
    expect(t.releaseDate).toBeNull();
    expect(t.remote?.downloadable).toBe(false);
  });

  it("labels licenses and genres", () => {
    expect(licenseLabel("https://creativecommons.org/licenses/by/4.0/")).toBe("CC BY");
    expect(licenseLabel(null)).toBeNull();
    expect(genreLabel("rnb")).toBe("R&B");
    expect(genreLabel("jazz")).toBe("Jazz");
  });

  it("library tracks still stream from storage", () => {
    expect(trackAudioUrl({ id: "abc", remote: undefined })).toBe("/api/music/tracks/abc/stream");
  });
});
