package events

import "github.com/rpsoftech/DigiGold/MainServerGo/interfaces"

type otpReqEvent struct {
	*BaseEvent `bson:"inline"`
}

const (
	OTPReqEvent    = "OTPReqEvent"
	OTPResendEvent = "OTPResendEvent"
	OTPVerifyEvent = "OTPVerifyEvent"
)

func (base *otpReqEvent) Add() *otpReqEvent {
	base.ParentNames = []string{base.EventName, "OTPReqEvent"}
	base.CreateBaseEvent()
	return base
}

func CreateNewOTPReqEvent(entity *interfaces.OTPRequest) *otpReqEvent {
	event := &otpReqEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.ReqId,
			TenantId:  entity.TenantId,
			Payload:   entity,
			EventName: OTPReqEvent,
		},
	}
	event.Add()
	return event
}

// Resend OTP Request
func CreateNewOTPResendEvent(entity *interfaces.OTPRequest) *otpReqEvent {
	event := &otpReqEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.ReqId,
			TenantId:  entity.TenantId,
			Payload:   entity,
			EventName: OTPResendEvent,
		},
	}
	event.Add()
	return event
}

// Verify OTP Request
func CreateNewOTPVerifyEvent(entity *interfaces.OTPRequest) *otpReqEvent {
	event := &otpReqEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.ReqId,
			TenantId:  entity.TenantId,
			Payload:   entity,
			EventName: OTPVerifyEvent,
		},
	}
	event.Add()
	return event
}
