/**
 * ShowFormPage — used for both creating and editing a show.
 */
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FormErrorBanner } from '../../components/forms/FormErrorBanner';
import { FormField } from '../../components/forms/FormField';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { SelectInput } from '../../components/forms/SelectInput';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextArea } from '../../components/forms/TextArea';
import { TextInput } from '../../components/forms/TextInput';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { pickFieldErrors, pickTopMessage } from '../../api/errors';
import { NotFoundError, PermissionDeniedError } from '../../api/client';
import { useCreateShow, useShow, useUpdateShow } from '../../hooks/useShows';
import {
  CATEGORIES,
  SHOW_SECTIONS,
  SHOW_STATUSES,
  type ShowCreateInput,
  type ShowSection,
  type ShowStatus,
  type ShowUpdateInput,
} from '../../types/api';

interface FormState {
  title: string;
  slug: string;
  synopsis: string;
  section: ShowSection | '';
  status: ShowStatus;
  categories: string[];
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  synopsis: '',
  section: '',
  status: 'draft',
  categories: [],
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function ShowFormPage() {
  const navigate = useNavigate();
  const { showId } = useParams<{ showId?: string }>();
  const isEdit = showId !== undefined;

  const showQuery = useShow(isEdit ? Number(showId) : null);
  const createMutation = useCreateShow();
  const updateMutation = useUpdateShow(isEdit ? Number(showId) : 0);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEdit && showQuery.data) {
      const s = showQuery.data;
      setForm({
        title: s.title,
        slug: s.slug,
        synopsis: s.synopsis ?? '',
        section: s.section,
        status: s.status,
        categories: s.categories,
      });
    }
  }, [isEdit, showQuery.data]);

  const fieldErrors = { ...clientErrors, ...serverErrors };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.slug.trim()) errs.slug = 'Slug is required.';
    else if (!SLUG_RE.test(form.slug)) {
      errs.slug =
        'Slug must be lowercase letters, digits, and dashes only (no leading/trailing dash, no consecutive dashes).';
    }
    if (!form.section) errs.section = 'Section is required.';
    if (form.categories.length === 0) {
      errs.categories = 'Pick at least one category.';
    }
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerErrors({});
    if (!validate()) return;

    const payload: ShowCreateInput = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      synopsis: form.synopsis.trim() ? form.synopsis : null,
      section: form.section as ShowSection,
      status: form.status,
      categories: form.categories,
    };

    try {
      if (isEdit) {
        const update: ShowUpdateInput = {
          title: payload.title,
          slug: payload.slug,
          synopsis: payload.synopsis,
          section: payload.section,
          status: payload.status,
          categories: payload.categories,
        };
        await updateMutation.mutateAsync(update);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/app/shows');
    } catch (err) {
      const fields = pickFieldErrors(err);
      setServerErrors(fields);
    }
  };

  if (isEdit && showQuery.isLoading) {
    return <LoadingState label="Loading show…" />;
  }

  if (isEdit && showQuery.error) {
    if (showQuery.error instanceof NotFoundError) {
      return (
        <ErrorState
          title="Show not found"
          message="The show you tried to edit no longer exists."
        >
          <Link to="/app/shows" className="btn btn--primary">
            Back to Shows
          </Link>
        </ErrorState>
      );
    }
    if (showQuery.error instanceof PermissionDeniedError) {
      return (
        <ErrorState
          title="Permission denied"
          message="You do not have permission to edit shows."
        />
      );
    }
    return (
      <ErrorState
        message={showQuery.error.message}
        onRetry={() => showQuery.refetch()}
      />
    );
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <section data-testid="show-form-page">
      <nav className="breadcrumbs">
        <Link to="/app/shows">Shows</Link>
        <span>/</span>
        <span>{isEdit ? 'Edit show' : 'New show'}</span>
      </nav>
      <header className="page-header">
        <h1>{isEdit ? 'Edit show' : 'New show'}</h1>
        <p>
          {isEdit
            ? 'Update the show details. Backend validation is authoritative.'
            : 'Create a new show for the catalogue.'}
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate>
        <FormErrorBanner
          message={pickTopMessage(createMutation.error ?? updateMutation.error)}
        />

        <FormField id="title" label="Title" required error={fieldErrors.title}>
          <TextInput
            id="title"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            maxLength={255}
            describedBy={fieldErrors.title ? 'title-error' : undefined}
          />
        </FormField>

        <FormField
          id="slug"
          label="Slug"
          required
          hint="URL-friendly identifier (e.g. motis-many-lives)."
          error={fieldErrors.slug}
        >
          <TextInput
            id="slug"
            value={form.slug}
            onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
            maxLength={255}
            describedBy={fieldErrors.slug ? 'slug-error' : 'slug-hint'}
          />
        </FormField>

        <FormField
          id="synopsis"
          label="Synopsis"
          hint="Long-form description shared by all episodes."
          error={fieldErrors.synopsis}
        >
          <TextArea
            id="synopsis"
            value={form.synopsis}
            onChange={(v) => setForm((f) => ({ ...f, synopsis: v }))}
          />
        </FormField>

        <FormField id="section" label="Section" required error={fieldErrors.section}>
          <SelectInput<ShowSection>
            id="section"
            value={form.section}
            onChange={(v) =>
              setForm((f) => ({ ...f, section: v as ShowSection | '' }))
            }
            options={[
              { value: '', label: 'Pick a section…' },
              ...SHOW_SECTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </FormField>

        <FormField id="status" label="Status" required error={fieldErrors.status}>
          <SelectInput<ShowStatus>
            id="status"
            value={form.status}
            onChange={(v) =>
              setForm((f) => ({ ...f, status: (v || 'draft') as ShowStatus }))
            }
            options={SHOW_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </FormField>

        <FormField
          id="categories"
          label="Categories"
          required
          hint="Pick at least one content category."
          error={fieldErrors.categories}
        >
          <MultiSelect
            id="categories"
            value={form.categories}
            options={CATEGORIES}
            onChange={(next) => setForm((f) => ({ ...f, categories: next }))}
          />
        </FormField>

        <div className="row-actions" style={{ marginTop: 16 }}>
          <SubmitButton
            isSubmitting={isSubmitting}
            label={isEdit ? 'Save changes' : 'Create show'}
          />
          <Link to="/app/shows" className="btn btn--ghost">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}