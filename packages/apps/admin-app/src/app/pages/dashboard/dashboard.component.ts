import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'dg-dashboard',
  template: `
    <div class="space-y-6">
      <h2 class="text-2xl font-bold">Store Dashboard</h2>
      <div class="grid grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-gray-500 text-sm font-semibold">Total Revenue</div>
          <div class="text-3xl font-black mt-2">₹1,240,500</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-gray-500 text-sm font-semibold">Active Trades</div>
          <div class="text-3xl font-black mt-2">1,842</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="text-gray-500 text-sm font-semibold">Pending KYCs</div>
          <div class="text-3xl font-black mt-2 text-yellow-500">14</div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {}
