import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  UserCheck,
  Calendar,
  Trash2,
  CheckCircle2,
  XCircle,
  Camera,
  RefreshCw,
  MapPin,
  ExternalLink,
  Building2,
  Navigation,
  FileText,
  Loader2,
} from 'lucide-react';
import { supabase } from './supabaseClient';

const LOKASI_KANTOR = {
  nama: 'SMKN 2 Banjarmasin',
  lat: -3.3204,
  lng: 114.5916,
  radiusMaksimal: 50000, // dalam meter
};

function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper mengubah DataURL (Base64) dari canvas menjadi file Blob untuk di-upload ke Storage
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export default function App() {
  const [nama, setNama] = useState('');
  const [divisi, setDivisi] = useState('IT & Development');
  const [status, setStatus] = useState('Hadir');
  const [keterangan, setKeterangan] = useState('');
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());

  // State Kamera & Foto Selfie
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // State Lokasi GPS
  const [lokasi, setLokasi] = useState(null);
  const [jarakLokasi, setJarakLokasi] = useState(null);
  const [loadingLokasi, setLoadingLokasi] = useState(false);
  const [errorLokasi, setErrorLokasi] = useState('');

  // State Database & Loading
  const [riwayatAbsen, setRiwayatAbsen] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [sedangMengirim, setSedangMengirim] = useState(false);
  const [modalNotif, setModalNotif] = useState(null);

  // Ambil data riwayat dari Supabase saat halaman dibuka
  const ambilRiwayatDariSupabase = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('absensi')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRiwayatAbsen(data);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    ambilRiwayatDariSupabase();
    const timer = setInterval(() => setWaktuSekarang(new Date()), 1000);
    return () => {
      clearInterval(timer);
      matikanKamera();
    };
  }, []);

  const handleUbahStatus = (statusBaru) => {
    setStatus(statusBaru);
    if (statusBaru !== 'Hadir') {
      matikanKamera();
      setFotoSelfie(null);
      setLokasi(null);
      setJarakLokasi(null);
      setErrorLokasi('');
    }
  };

  const ambilLokasiGPS = () => {
    if (!navigator.geolocation) {
      setErrorLokasi('Browser tidak mendukung fitur GPS.');
      return;
    }

    setLoadingLokasi(true);
    setErrorLokasi('');

    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        const userLat = posisi.coords.latitude;
        const userLng = posisi.coords.longitude;
        const jarak = hitungJarakMeter(
          userLat,
          userLng,
          LOKASI_KANTOR.lat,
          LOKASI_KANTOR.lng
        );

        setLokasi({
          lat: userLat.toFixed(6),
          lng: userLng.toFixed(6),
          akurasi: Math.round(posisi.coords.accuracy),
        });
        setJarakLokasi(jarak);
        setLoadingLokasi(false);
      },
      (err) => {
        setLoadingLokasi(false);
        if (err.code === 1) {
          setErrorLokasi('Izin lokasi ditolak. Aktifkan GPS di pengaturan browser.');
        } else {
          setErrorLokasi('Gagal mendeteksi lokasi GPS. Silakan refresh GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const nyalakanKamera = async () => {
    setFotoSelfie(null);
    setKameraAktif(true);
    ambilLokasiGPS();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setKameraAktif(false);
      setModalNotif({
        tipe: 'ditolak',
        judul: 'Kamera Tidak Dapat Diakses',
        pesan: 'Pastikan izin kamera pada browser sudah diaktifkan.',
      });
    }
  };

  const matikanKamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setKameraAktif(false);
  };

  const ambilFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = 400;
    const height = (video.videoHeight / video.videoWidth) * width;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    setFotoSelfie(canvas.toDataURL('image/jpeg', 0.8));
    matikanKamera();
  };

  const handleAbsen = async (e) => {
    e.preventDefault();
    if (!nama.trim() || sedangMengirim) return;

    if (status === 'Hadir') {
      if (!fotoSelfie) {
        setModalNotif({
          tipe: 'ditolak',
          judul: 'Foto Selfie Diperlukan',
          pesan: 'Untuk status Hadir, silakan buka kamera dan ambil foto selfie terlebih dahulu.',
        });
        return;
      }

      if (!lokasi || jarakLokasi === null) {
        setModalNotif({
          tipe: 'ditolak',
          judul: 'Lokasi GPS Belum Terdeteksi',
          pesan: 'Pastikan izin GPS aktif dan klik "Refresh GPS" sebelum mengirim absensi.',
        });
        return;
      }

      if (jarakLokasi > LOKASI_KANTOR.radiusMaksimal) {
        setModalNotif({
          tipe: 'ditolak',
          judul: 'Absensi Ditolak — Di Luar Area Lokasi',
          pesan: `Posisi kamu saat ini berada sekitar ${jarakLokasi.toLocaleString('id-ID')} meter dari ${LOKASI_KANTOR.nama}.`,
          detail: `Batas maksimal jarak absensi yang diizinkan adalah ${LOKASI_KANTOR.radiusMaksimal} meter.`,
        });
        return;
      }
    }

    setSedangMengirim(true);

    try {
      let publicFotoUrl = null;

      // 1. Jika status Hadir, upload foto selfie ke Supabase Storage
      if (status === 'Hadir' && fotoSelfie) {
        const blob = dataURLtoBlob(fotoSelfie);
        const namaFile = `selfie_${Date.now()}_${nama.trim().replace(/\s+/g, '_')}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('selfie-absensi')
          .upload(namaFile, blob, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('selfie-absensi')
          .getPublicUrl(namaFile);

        publicFotoUrl = urlData.publicUrl;
      }

      const tanggalStr = waktuSekarang.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const jamStr = waktuSekarang.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // 2. Simpan data absensi ke tabel PostgreSQL Supabase
      const { error: insertError } = await supabase.from('absensi').insert([
        {
          nama: nama.trim(),
          divisi,
          status,
          keterangan: status !== 'Hadir' ? keterangan.trim() : '-',
          foto_url: publicFotoUrl,
          lat: status === 'Hadir' ? lokasi.lat : null,
          lng: status === 'Hadir' ? lokasi.lng : null,
          jarak: status === 'Hadir' ? jarakLokasi : null,
          tanggal: tanggalStr,
          jam: jamStr,
        },
      ]);

      if (insertError) throw insertError;

      // Refresh daftar riwayat dari database
      await ambilRiwayatDariSupabase();

      setModalNotif({
        tipe: 'sukses',
        judul: 'Absensi Diterima!',
        pesan:
          status === 'Hadir'
            ? `Kehadiran ${nama.trim()} (${divisi}) berhasil tersimpan ke server.`
            : `Pengajuan ${status} untuk ${nama.trim()} (${divisi}) berhasil tersimpan.`,
        detail:
          status === 'Hadir'
            ? `Jarak dari titik lokasi: ${jarakLokasi} meter • Pukul ${jamStr}`
            : `Status: ${status} • Pukul ${jamStr}`,
      });

      // Reset Form
      setNama('');
      setKeterangan('');
      setFotoSelfie(null);
      setLokasi(null);
      setJarakLokasi(null);
    } catch (err) {
      setModalNotif({
        tipe: 'ditolak',
        judul: 'Gagal Menyimpan ke Server',
        pesan: err.message || 'Terjadi kesalahan saat menghubungi database Supabase.',
      });
    } finally {
      setSedangMengirim(false);
    }
  };

  const hapusData = async (id) => {
    const { error } = await supabase.from('absensi').delete().eq('id', id);
    if (!error) {
      setRiwayatAbsen(riwayatAbsen.filter((item) => item.id !== id));
    }
  };

  const dalamRadius = jarakLokasi !== null && jarakLokasi <= LOKASI_KANTOR.radiusMaksimal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/50 py-8 px-4 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Modern */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-center border border-white gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-3.5 rounded-2xl text-white shadow-md shadow-blue-500/20">
              <Building2 size={30} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Cloud Database Terhubung
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Sistem Absensi Digital
              </h1>
              <p className="text-xs text-slate-500">
                Area Lokasi: {LOKASI_KANTOR.nama} • Radius Maksimal {LOKASI_KANTOR.radiusMaksimal}m
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto text-center md:text-right bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm">
            <div className="flex items-center justify-center md:justify-end gap-2 text-blue-400 font-mono font-bold text-2xl tracking-wider">
              <Clock size={20} />
              <span>{waktuSekarang.toLocaleTimeString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-1.5 text-xs text-slate-300 mt-1">
              <Calendar size={13} />
              <span>
                {waktuSekarang.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Form Input Absensi */}
        <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8 border border-slate-200/80">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Form Kehadiran</h2>
            <p className="text-xs text-slate-500">Isi nama lengkap, pilih divisi, dan status kehadiran</p>
          </div>

          <form onSubmit={handleAbsen} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap..."
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Divisi / Departemen
                </label>
                <select
                  value={divisi}
                  onChange={(e) => setDivisi(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                >
                  <option value="IT & Development">IT & Development</option>
                  <option value="Human Resources (HRD)">Human Resources (HRD)</option>
                  <option value="Finance & Accounting">Finance & Accounting</option>
                  <option value="Marketing & Sales">Marketing & Sales</option>
                  <option value="Desain & Kreatif">Desain & Kreatif</option>
                  <option value="Operasional & Umum">Operasional & Umum</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Hadir', 'Izin', 'Sakit'].map((opsi) => (
                    <button
                      key={opsi}
                      type="button"
                      onClick={() => handleUbahStatus(opsi)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        status === opsi
                          ? opsi === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : opsi === 'Izin'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opsi}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {status === 'Hadir' ? (
              <div className="bg-slate-50/80 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-4">
                <canvas ref={canvasRef} className="hidden" />

                {!kameraAktif && !fotoSelfie && (
                  <div className="text-center space-y-2 py-2">
                    <p className="text-xs text-slate-500">
                      Verifikasi wajah & lokasi GPS di area <strong>{LOKASI_KANTOR.nama}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={nyalakanKamera}
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-6 rounded-xl shadow-sm transition cursor-pointer"
                    >
                      <Camera size={18} />
                      Buka Kamera & Cek Lokasi
                    </button>
                  </div>
                )}

                {kameraAktif && (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-blue-500 shadow-md">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full scale-x-[-1]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={ambilFoto}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Camera size={16} />
                        Jepret Foto
                      </button>
                      <button
                        type="button"
                        onClick={matikanKamera}
                        className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium py-2 px-4 rounded-xl transition cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {fotoSelfie && (
                  <div className="flex flex-col items-center gap-2.5">
                    <img
                      src={fotoSelfie}
                      alt="Preview Selfie"
                      className="w-48 rounded-2xl border-2 border-emerald-500 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={nyalakanKamera}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      Ambil Ulang Foto
                    </button>
                  </div>
                )}

                {(kameraAktif || fotoSelfie || loadingLokasi || errorLokasi) && (
                  <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-3.5 text-xs shadow-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Navigation
                          size={16}
                          className={
                            lokasi
                              ? dalamRadius
                                ? 'text-emerald-600 shrink-0'
                                : 'text-rose-600 shrink-0'
                              : 'text-slate-400 shrink-0'
                          }
                        />
                        {loadingLokasi && (
                          <span className="text-slate-500 font-medium">
                            Mendeteksi titik GPS...
                          </span>
                        )}
                        {errorLokasi && (
                          <span className="text-rose-600 font-medium">{errorLokasi}</span>
                        )}
                        {lokasi && !loadingLokasi && (
                          <div>
                            <span className="font-mono font-semibold text-slate-800">
                              {lokasi.lat}, {lokasi.lng}
                            </span>
                            <span className="text-slate-400 ml-1.5">
                              (Akurasi ±{lokasi.akurasi}m)
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={ambilLokasiGPS}
                        className="text-blue-600 hover:text-blue-800 font-semibold shrink-0 cursor-pointer"
                      >
                        Refresh GPS
                      </button>
                    </div>

                    {jarakLokasi !== null && !loadingLokasi && (
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium ${
                          dalamRadius
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span>
                          Jarak ke {LOKASI_KANTOR.nama}:{' '}
                          <strong>{jarakLokasi.toLocaleString('id-ID')} meter</strong>
                        </span>
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-white/80">
                          {dalamRadius ? 'Dalam Radius (≤500m)' : 'Di Luar Radius (>500m)'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                  <FileText size={16} />
                  <span>Mode {status}: Foto selfie dan lokasi GPS tidak diperlukan.</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alasan / Keterangan {status} (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder={`Tuliskan keterangan ${status.toLowerCase()}...`}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sedangMengirim}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {sedangMengirim ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Menyimpan ke Server...
                </>
              ) : (
                <>
                  <UserCheck size={18} />
                  Kirim Absensi Sekarang
                </>
              )}
            </button>
          </form>
        </div>

        {/* Tabel Riwayat Absensi */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Riwayat Kehadiran (Live Database)</h2>
              <p className="text-xs text-slate-500">Data tersinkronisasi otomatis untuk semua perangkat</p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3.5 py-1.5 rounded-full">
              {riwayatAbsen.length} Tercatat
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-6">Foto</th>
                  <th className="py-3.5 px-6">Nama & Divisi</th>
                  <th className="py-3.5 px-6">Waktu</th>
                  <th className="py-3.5 px-6">Lokasi / Keterangan</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loadingData ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-400 text-sm">
                      Memuat data dari server...
                    </td>
                  </tr>
                ) : riwayatAbsen.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-400 text-sm">
                      Belum ada data presensi hari ini.
                    </td>
                  </tr>
                ) : (
                  riwayatAbsen.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6">
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={item.nama}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/30"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400">
                            {item.status}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">{item.nama}</div>
                        <div className="text-xs text-slate-500">{item.divisi}</div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        <div className="font-medium text-xs">{item.tanggal}</div>
                        <div className="text-xs font-mono text-slate-400">{item.jam}</div>
                      </td>
                      <td className="py-3.5 px-6">
                        {item.lat && item.lng ? (
                          <div className="space-y-0.5">
                            <a
                              href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <MapPin size={13} />
                              <span>Lihat di Maps</span>
                              <ExternalLink size={11} />
                            </a>
                            <div className="text-[11px] text-slate-400">
                              Jarak: {item.jarak}m dari lokasi
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            {item.keterangan || 'Tanpa keterangan'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === 'Hadir'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'Izin'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => hapusData(item.id)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer"
                          title="Hapus data"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* POP-UP NOTIFIKASI */}
      {modalNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div
              className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                modalNotif.tipe === 'sukses'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              {modalNotif.tipe === 'sukses' ? (
                <CheckCircle2 size={36} />
              ) : (
                <XCircle size={36} />
              )}
            </div>

            <div className="space-y-1.5">
              <h3
                className={`text-xl font-extrabold ${
                  modalNotif.tipe === 'sukses' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {modalNotif.judul}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{modalNotif.pesan}</p>
              {modalNotif.detail && (
                <p className="text-xs text-slate-400 pt-1">{modalNotif.detail}</p>
              )}
            </div>

            <button
              onClick={() => setModalNotif(null)}
              className={`w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition cursor-pointer ${
                modalNotif.tipe === 'sukses'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}