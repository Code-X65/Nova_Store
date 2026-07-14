import { useEffect, useRef } from 'react';
import type { Notification } from '@/shared/api/types';
import { useAdminRealtime } from '@/admin/hooks/useSharedRealtime';

export { useAdminRealtime };
export default useAdminRealtime;
