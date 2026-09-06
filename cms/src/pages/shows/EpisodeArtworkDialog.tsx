/**
 * EpisodeArtworkDialog — modal wrapper around EpisodeArtworkPanel (Phase 7C).
 */
import { Dialog } from "../../components/dialogs/Dialog";
import { EpisodeArtworkPanel } from "./EpisodeArtworkPanel";
import type { Episode } from "../../types/api";

interface Props {
  episode: Episode;
  onClose: () => void;
}

export function EpisodeArtworkDialog({ episode, onClose }: Props) {
  return (
    <Dialog
      title={`Artwork: ${episode.title}`}
      onClose={onClose}
      testId="artwork-dialog"
    >
      <EpisodeArtworkPanel episode={episode} />
    </Dialog>
  );
}
