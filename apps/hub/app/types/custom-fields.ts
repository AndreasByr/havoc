export type CustomFieldEntry = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  inputType: string;
  options: string[] | null;
  sliderMin: number | null;
  sliderMax: number | null;
  sliderStep: number | null;
  required: boolean;
  value: unknown;
  canEdit: boolean;
};

export type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  inputType: string;
  options: string[] | null;
  sliderMin: number | null;
  sliderMax: number | null;
  sliderStep: number | null;
  required: boolean;
  active: boolean;
  isDefault: boolean;
  userCanView: boolean;
  userCanEdit: boolean;
  modCanView: boolean;
  modCanEdit: boolean;
  sortOrder: number;
};

export type CommunityTag = {
  id: string;
  name: string;
};
