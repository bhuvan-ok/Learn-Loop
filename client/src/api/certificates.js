import api from './client';

// Certificates are served as a raw PDF stream (not JSON), so the axios
// response has to be pulled down as a blob and turned into a temporary
// download link — a plain <a href> wouldn't carry the auth header.
export async function downloadCertificate(courseId) {
  const res = await api.get(`/certificates/course/${courseId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'certificate.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
