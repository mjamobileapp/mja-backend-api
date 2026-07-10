const getTodayStringYYYYMMDD = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const formatTanggalWIB = (dateString) => {
  const date = new Date(dateString);
  const monthNames = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  const tanggal = String(date.getDate()).padStart(2, "0");
  const bulan = monthNames[date.getMonth()];
  const tahun = date.getFullYear();

  return `${tanggal} ${bulan} ${tahun}`;
};

const formatTanggalJamWIB = (dateString) => {
  const date = new Date(dateString);
  const tanggal = String(date.getDate()).padStart(2, "0");
  const bulan = String(date.getMonth() + 1).padStart(2, "0");
  const tahun = date.getFullYear();
  const jam = String(date.getHours()).padStart(2, "0");
  const menit = String(date.getMinutes()).padStart(2, "0");

  return `${tanggal}/${bulan}/${tahun} ${jam}:${menit} WIB`;
};

const getDateFilterCondition = (columnName, filter = "") => {
  const normalizedFilter = String(filter || "").trim().toLowerCase();

  if (!normalizedFilter) {
    return "1=1";
  }

  switch (normalizedFilter) {
    case "kemarin":
    case "yesterday":
      return `DATE(${columnName}) = CURDATE() - INTERVAL 1 DAY`;
    case "mingguan":
    case "minggu":
    case "weekly":
      return `YEARWEEK(${columnName}, 1) = YEARWEEK(CURDATE(), 1)`;
    case "bulanan":
    case "bulan":
    case "monthly":
      return `YEAR(${columnName}) = YEAR(CURDATE()) AND MONTH(${columnName}) = MONTH(CURDATE())`;
    case "hari_ini":
    case "hari-ini":
    case "today":
    default:
      return `DATE(${columnName}) = CURDATE()`;
  }
};

module.exports = {
  getTodayStringYYYYMMDD,
  formatTanggalWIB,
  formatTanggalJamWIB,
  getDateFilterCondition,
};
