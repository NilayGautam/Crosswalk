import { z } from "zod";

/** The client id the CLI presents in the device authorization flow. */
export const CLI_CLIENT_ID = "crosswalk-cli";

export const COLUMN_TYPES = [
  "text",
  "integer",
  "number",
  "boolean",
  "date",
  "datetime",
  "empty",
] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const DATASET_FORMATS = ["csv", "tsv", "xlsx", "xls", "parquet", "dta"] as const;
export type DatasetFormat = (typeof DATASET_FORMATS)[number];

export const MAX_COLUMNS = 5000;
export const MAX_DATASETS_PER_REQUEST = 500;
/** Row counts are stored as 32-bit integers. */
export const MAX_ROW_COUNT = 2_147_483_647;

/**
 * What the CLI reports about one column. It describes the column's form and
 * never carries a cell value.
 */
export const columnProfileSchema = z.object({
  name: z.string().max(500),
  type: z.enum(COLUMN_TYPES),
  /** Share of profiled rows where the cell is empty, from 0 to 1. */
  nullRate: z.number().min(0).max(1),
  /** Number of different non-empty values among the profiled rows. */
  distinctCount: z.number().int().min(0),
  /** Distinct non-empty values divided by non-empty rows, from 0 to 1. */
  uniqueRate: z.number().min(0).max(1),
  /** A description of what values look like, for example "6 digits". */
  shape: z.string().max(200),
});
export type ColumnProfile = z.infer<typeof columnProfileSchema>;

export const datasetCardSchema = z.object({
  /** Stable identity inside a project: the relative path, plus the sheet for workbooks. */
  key: z.string().min(1).max(1000),
  /** The name shown on the card. */
  name: z.string().min(1).max(500),
  /** Path relative to the linked folder. */
  path: z.string().min(1).max(1000),
  sheet: z.string().max(500).nullable(),
  format: z.enum(DATASET_FORMATS),
  rowCount: z.number().int().min(0).max(MAX_ROW_COUNT),
  /** How many rows the column profiles were computed from. */
  profiledRows: z.number().int().min(0).max(MAX_ROW_COUNT),
  columns: z.array(columnProfileSchema).max(MAX_COLUMNS),
});
export type DatasetCard = z.infer<typeof datasetCardSchema>;

export const putDatasetsBodySchema = z.object({
  datasets: z.array(datasetCardSchema).max(MAX_DATASETS_PER_REQUEST),
});
export type PutDatasetsBody = z.infer<typeof putDatasetsBodySchema>;

export const positionSchema = z.object({
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
});
export type Position = z.infer<typeof positionSchema>;

export const projectNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z.string().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters."),
  );

export const projectBodySchema = z.object({ name: projectNameSchema });

/** A dataset as the server stores it and the canvas draws it. */
export interface Dataset extends DatasetCard {
  id: string;
  projectId: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  datasetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicConfig {
  googleSignIn: boolean;
  /** The address of the web app, which the CLI prints after sending datasets. */
  publicUrl: string;
}

export * from "./layout";
