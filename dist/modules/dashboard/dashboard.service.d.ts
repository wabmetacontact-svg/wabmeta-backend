export declare class DashboardService {
    getStats(organizationId: string): Promise<any>;
    getWidgets(organizationId: string, days?: number): Promise<any>;
    getActivity(organizationId: string, limit?: number): Promise<any>;
    invalidateCache(organizationId: string): void;
}
export declare const dashboardService: DashboardService;
export default dashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map