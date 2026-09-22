export type Filters = {
  categories: string[];
  job_type: string;
  max_distance: number;
  min_pay: number;
  max_pay: number;
  min_experience: number;
  max_experience: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};
