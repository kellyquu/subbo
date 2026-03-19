export type UserRole = "user" | "admin";

export type VerificationType = "standard";

export type UseCase = "room" | "property" | "car" | "item" | "generic";

export type VerificationStatus =
  | "draft"
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export type MediaType =
  | "reference_image"
  | "captured_video"
  | "derived_thumbnail";

export interface User {
  id: string;
  auth_id: string;
  role: UserRole;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  owner_user_id: string;
  verification_type: VerificationType;
  use_case: UseCase;
  status: VerificationStatus;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationMedia {
  id: string;
  verification_id: string;
  media_type: MediaType;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface VerificationResult {
  id: string;
  verification_id: string;
  similarity_score: number | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PublicVerificationShare {
  id: string;
  verification_id: string;
  public_slug: string;
  is_active: boolean;
  created_at: string;
}

// Joined/composed types used in the UI
export interface VerificationWithDetails extends Verification {
  media: VerificationMedia[];
  result: VerificationResult | null;
  share: PublicVerificationShare | null;
  profile: Pick<Profile, "full_name" | "avatar_url"> | null;
}

export interface AnalysisInput {
  referenceImagePaths: string[];
  capturedVideoPaths: string[];
  useCase: UseCase;
}

export interface AnalysisOutput {
  similarity_score: number;
  summary: string;
  metadata: Record<string, unknown>;
}
