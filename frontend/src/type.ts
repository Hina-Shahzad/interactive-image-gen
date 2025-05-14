export type ParamResponse = {
    [key: string]: {
        name: string;
        widget: string;
        min: number;
        max: number;
        value: number;
    };
};
export interface ParamMetadata {
  max: number;
  min: number;
  name: string;
  value: number;
  widget: string;
}

