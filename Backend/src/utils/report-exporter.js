exports.toCSV = (dataList) => {
  if (!dataList || !dataList.length) return '';

  const headers = Object.keys(dataList[0]);
  const rows = dataList.map(row => {
    return headers.map(header => {
      let cell = row[header] === null || row[header] === undefined ? '' : row[header];
      cell = String(cell).replace(/"/g, '""');
      return `"${cell}"`;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};
