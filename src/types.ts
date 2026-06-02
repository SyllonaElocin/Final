export interface User {
  id: number;
  email: string;
  role: 'researcher' | 'reviewer' | 'basic';
}

export interface CoAuthor {
  id: number;
  publication_id: number;
  name: string;
  affiliation: string;
}

export interface Publication {
  id: number;
  user_id: number;
  title: string;
  abstract: string;
  pdf_url?: string | null;  // Only populated for reviewers/premium
  dataset_url?: string | null; // Only populated for reviewers/premium
  created_at: string;
  co_authors?: CoAuthor[];
  researcher_email?: string;
}

export interface Portfolio {
  id: number;
  user_id: number;
  bio: string;
  credentials: string;
}
