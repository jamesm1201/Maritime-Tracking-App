namespace HormuzBackend.Hubs;

using Microsoft.AspNetCore.SignalR;

public class MissionHub : Hub
{
    // SignalR hub for mission updates
    // Extends Hub from SignalR to manage real-time communication with clients
    // Clients can join or leave groups based on mission IDs to recieve events from backend
    public async Task JoinMission(string missionId)
    {
        // SignalR groups allow clients to subscribe to specific topics (missions) for targeted updates
        // MissionID is group name from frontend
        await Groups.AddToGroupAsync(Context.ConnectionId, missionId);
    }

    public async Task LeaveMission(string missionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, missionId);
    }
}