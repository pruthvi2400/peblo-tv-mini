/**
 * Dialog used to create or edit a season inside the ShowDetailPage.
 */
import { FormEvent, useEffect, useState } from 'react';

import { Dialog } from '../../components/dialogs/Dialog';
import { FormErrorBanner } from '../../components/forms/FormErrorBanner';
import { FormField } from '../../components/forms/FormField';
import { NumberInput } from '../../components/forms/NumberInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import {
  pickFieldErrors,
  pickTopMessage,
} from '../../api/errors';
import {
  useCreateSeason,
  useUpdateSeason,
} from '../../hooks/useSeasons';
import type { Season } from '../../types/api';

interface Props {
  showId: number;
  /** If null, we're creating; otherwise editing the given season. */
  season: Season | null;
  onClose: () => void;
  /** Called after a successful create/update with the resulting season. */
  onSaved: (season: Season) => void;
}

export function SeasonFormDialog({ showId, season, onClose, onSaved }: Props) {
  const isEdit = season !== null;
  const createMutation = useCreateSeason();
  const updateMutation = useUpdateSeason(
    season?.id ?? 0,
    showId,
  );

  const [seasonNumber, setSeasonNumber] = useState<number | ''>(
    season?.season_number ?? '',
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSeasonNumber(season?.season_number ?? '');
    setClientErrors({});
    setServerErrors({});
  }, [season]);

  const fieldErrors = { ...clientErrors, ...serverErrors };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerErrors({});
    const errs: Record<string, string> = {};
    if (seasonNumber === '' || seasonNumber < 0) {
      errs.season_number = 'Season number must be 0 or greater (0 = trailers).';
    }
    setClientErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const saved = isEdit
        ? await updateMutation.mutateAsync({ season_number: seasonNumber as number })
        : await createMutation.mutateAsync({
            show_id: showId,
            season_number: seasonNumber as number,
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      setServerErrors(pickFieldErrors(err));
    }
  };

  return (
    <Dialog
      title={isEdit ? 'Edit season' : 'New season'}
      onClose={onClose}
      testId="season-form-dialog"
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
            form="season-form"
            className="btn btn--primary"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="season-form-submit"
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
      <form id="season-form" onSubmit={onSubmit} noValidate>
        <FormErrorBanner
          message={pickTopMessage(
            createMutation.error ?? updateMutation.error,
          )}
        />
        <FormField
          id="season-number"
          label="Season number"
          required
          hint="0 = trailers (not exposed as a normal season)."
          error={fieldErrors.season_number}
        >
          <NumberInput
            id="season-number"
            value={seasonNumber}
            onChange={setSeasonNumber}
            min={0}
            step={1}
          />
        </FormField>
        {/* SubmitButton is mounted inside the form but rendered via the
            dialog footer for layout. We still include it for the data-testid
            hook so tests can find the submit control. */}
        <span hidden>
          <SubmitButton isSubmitting={false} />
        </span>
      </form>
    </Dialog>
  );
}