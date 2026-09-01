import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, LaptopIcon, LoaderIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { axiosInstance } from "../../../shared/lib/axios";

const describeDevice = (userAgent) => {
  if (!userAgent) return "Browser không xác định";
  const browser = userAgent.includes("Edg/")
    ? "Microsoft Edge"
    : userAgent.includes("Firefox/")
      ? "Firefox"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const operatingSystem = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Android")
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS/iPadOS"
        : userAgent.includes("Mac OS")
          ? "macOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "Thiết bị không xác định";
  return `${browser} trên ${operatingSystem}`;
};

const formatDate = (value) => new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

function DeviceSecurityPage() {
  const { currentDeviceId, isE2EEReady } = useAuthStore();
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingDeviceId, setRevokingDeviceId] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/auth/devices");
      setDevices(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách thiết bị");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const revokeDevice = async (device) => {
    if (device.deviceId === currentDeviceId) return;
    if (!window.confirm(
      `Thu hồi ${describeDevice(device.name)}? Phiên đăng nhập trên thiết bị đó sẽ bị ngắt.`
    )) return;

    setRevokingDeviceId(device.deviceId);
    try {
      await axiosInstance.delete(`/auth/devices/${encodeURIComponent(device.deviceId)}`);
      setDevices((current) => current.filter((item) => item.deviceId !== device.deviceId));
      toast.success("Đã thu hồi thiết bị và phiên đăng nhập");
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể thu hồi thiết bị");
    } finally {
      setRevokingDeviceId(null);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-700/70 bg-slate-900/90 p-5 shadow-2xl backdrop-blur md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          aria-label="Quay lại"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
          <ShieldCheckIcon size={24} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Thiết bị và phiên đăng nhập</h1>
          <p className="text-sm text-slate-400">Quản lý các browser được phép nhận khóa E2EE.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-cyan-300">
          <LoaderIcon className="animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center text-slate-400">
          Chưa có thiết bị E2EE đang hoạt động.
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {devices.map((device) => {
            const isCurrent = device.deviceId === currentDeviceId;
            const isRevoking = revokingDeviceId === device.deviceId;
            return (
              <div
                key={device.deviceId}
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-slate-300">
                  <LaptopIcon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-100">{describeDevice(device.name)}</p>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        Thiết bị hiện tại
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Hoạt động gần nhất: {formatDate(device.lastSeenAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isE2EEReady || !currentDeviceId || isCurrent || isRevoking}
                  onClick={() => revokeDevice(device)}
                  title={isCurrent ? "Không thể thu hồi thiết bị đang dùng" : "Thu hồi thiết bị"}
                  className="rounded-lg p-2 text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isRevoking
                    ? <LoaderIcon className="animate-spin" size={19} />
                    : <Trash2Icon size={19} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Khi thu hồi, device bị loại khỏi key bundle, session bị vô hiệu hóa và kết nối realtime bị
        ngắt. Tin nhắn hoặc khóa đã lưu từ trước trên thiết bị đó không thể bị xóa từ xa.
      </p>
    </div>
  );
}

export default DeviceSecurityPage;
