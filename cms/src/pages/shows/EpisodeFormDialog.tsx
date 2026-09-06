/**
 * Dialog used to create or edit an episode inside the ShowDetailPage.
 *
 * The `artwork` field is omitted; artwork upload ships in Phase 7C.
 */
import { FormEvent, useEffect, useState } from 'react';

import { Dialog } from '../../components/dialogs/Dialog';
import { FormErrorBanner } from '../../components/forms/FormErrorBanner';
import { FormField } from '../../components/forms/FormField';
import { NumberInput } from '../../components/forms/NumberInput';
import { SelectInput } from '../../components/forms/SelectInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextInput } from '../../components/forms/TextInput';
import { pickFieldErrors, pickTopMessage } from '../../api/errors';
import {
  useCreateEpisode,
  useUpdateEpisode,
} from '../../hooks/useEpisodes';
import {
  EPISODE_STATUSES,
  LANGUAGES,
  type Episode,
  type EpisodeCreateInput,
  type EpisodeStatus,
  type Language,
} from '../../types/api';

interface Props {
  seasonId: number;
  episode: Episode | null;
  onClose: () => void;
  onSaved: (episode: Episode) => void;
}

interface FormState {
  title: string;
  episode_number: number | '';
  duration: number | '';
  language: Language;
  content_group: string;
  status: EpisodeStatus;
}

const EMPTY: FormState = {
  title: '',
  episode_number: '',
  duration: '',
  language: 'en',
  content_group: '',
  status: 'draft',
};

export function EpisodeFormDialog({
  seasonId,
  episode,
  onClose,
  onSaved,
}: Props) {
  const isEdit = episode !== null;
  const createMutation = useCreateEpisode();
  const updateMutation = useUpdateEpisode(
    episode?.id ?? 0,
    episode?.season_id ?? seasonId,
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (episode) {
      setForm({
        title: episode.title,
        episode_number: episode.episode_number,
        duration: episode.duration ?? '',
        language: episode.language as Language,
        content_group: episode.content_group,
        status: episode.status,
      });
    } else {
      setForm(EMPTY);
    }
    setClientErrors({});
    setServerErrors({});
  }, [episode]);

  const fieldErrors = { ...clientErrors, ...serverErrors };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (form.episode_number === '' || form.episode_number < 1) {
      errs.episode_number = 'Episode number must be 1 or greater.';
    }
    if (!form.content_group.trim()) {
      errs.content_group = 'Content group is required.';
    }
    if (form.status === 'published') {
      if (form.duration === '' || Number(form.duration) <= 0) {
        errs.duration =
          'A published episode must have a positive duration.';
      }
    }
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerErrors({});
    if (!validate()) return;

    const duration = form.duration === '' ? null : Number(form.duration);

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          title: form.title.trim(),
          episode_number: form.episode_number as number,
          duration,
          language: form.language,
          content_group: form.content_group.trim(),
          status: form.status,
        });
      } else {
        const payload: EpisodeCreateInput = {
          season_id: seasonId,
          title: form.title.trim(),
          episode_number: form.episode_number as number,
          duration,
          language: form.language,
          content_group: form.content_group.trim(),
          status: form.status,
        };
        const saved = await createMutation.mutateAsync(payload);
        onSaved(saved);
      }
      onClose();
    } catch (err) {
      setServerErrors(pickFieldErrors(err));
    }
  };

  return (
    <Dialog
      title={isEdit ? 'Edit episode' : 'New episode'}
      onClose={onClose}
      testId="episode-form-dialog"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="episode-form"
            className="btn btn--primary"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="episode-form-submit"
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving…'
              : isEdit
                ? 'Save'
                : 'Create'}
          </button>
        </>
      }
    >
      <form id="episode-form" onSubmit={onSubmit} noValidate>
        <FormErrorBanner
          message={pickTopMessage(
            createMutation.error ?? updateMutation.error,
          )}
        />
        <FormField id="episode-title" label="Title" required error={fieldErrors.title}>
          <TextInput
            id="episode-title"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            maxLength={255}
          />
        </FormField>
        <FormField
          id="episode-number"
          label="Episode number"
          required
          error={fieldErrors.episode_number}
        >
          <NumberInput
            id="episode-number"
            value={form.episode_number}
            onChange={(v) => setForm((f) => ({ ...f, episode_number: v }))}
            min={1}
            step={1}
          />
        </FormField>
        <FormField id="episode-language" label="Language" required>
          <SelectInput<Language>
            id="episode-language"
            value={form.language}
            onChange={(v) =>
              setForm((f) => ({ ...f, language: (v || 'en') as Language }))
            }
            options={LANGUAGES.map((l) => ({ value: l, label: l }))}
          />
        </FormField>
        <FormField
          id="content-group"
          label="Content group"
          required
          hint="Logical asset identifier. Unique per language."
          error={fieldErrors.content_group}
        >
          <TextInput
            id="content-group"
            value={form.content_group}
            onChange={(v) => setForm((f) => ({ ...f, content_group: v }))}
            maxLength={255}
          />
        </FormField>
        <FormField
          id="episode-duration"
          label="Duration (seconds)"
          hint="Required when status is published."
          error={fieldErrors.duration}
        >
          <NumberInput
            id="episode-duration"
            value={form.duration}
            onChange={(v) => setForm((f) => ({ ...f, duration: v }))}
            min={1}
            step={1}
          />
        </FormField>
        <FormField id="episode-status" label="Status" required>
          <SelectInput<EpisodeStatus>
            id="episode-status"
            value={form.status}
            onChange={(v) =>
              setForm((f) => ({ ...f, status: (v || 'draft') as EpisodeStatus }))
            }
            options={EPISODE_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </FormField>
        <span hidden>
          <SubmitButton isSubmitting={false} />
        </span>
      </form>
    </Dialog>
  );
}