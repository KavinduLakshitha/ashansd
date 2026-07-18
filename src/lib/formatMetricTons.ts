export const formatMetricTons = (value: number): string =>
  `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })} MT`;
