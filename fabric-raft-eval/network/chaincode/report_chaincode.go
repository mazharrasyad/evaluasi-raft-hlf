package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type ReportContract struct {
	contractapi.Contract
}

type Report struct {
	ReportID    string `json:"reportID"`
	Reporter    string `json:"reporter"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

func (c *ReportContract) SubmitReport(ctx contractapi.TransactionContextInterface, reportID, reporter, reportType, description string) error {
	exists, err := c.ReportExists(ctx, reportID)
	if err != nil {
		return fmt.Errorf("failed to check report existence: %w", err)
	}
	if exists {
		return fmt.Errorf("report %s already exists", reportID)
	}

	report := Report{
		ReportID:    reportID,
		Reporter:    reporter,
		Type:        reportType,
		Description: description,
	}

	payload, err := json.Marshal(report)
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	return ctx.GetStub().PutState(reportID, payload)
}

func (c *ReportContract) GetReport(ctx contractapi.TransactionContextInterface, reportID string) (*Report, error) {
	payload, err := ctx.GetStub().GetState(reportID)
	if err != nil {
		return nil, fmt.Errorf("failed to read report %s: %w", reportID, err)
	}
	if len(payload) == 0 {
		return nil, fmt.Errorf("report %s does not exist", reportID)
	}

	var report Report
	if err := json.Unmarshal(payload, &report); err != nil {
		return nil, fmt.Errorf("failed to unmarshal report %s: %w", reportID, err)
	}

	return &report, nil
}

func (c *ReportContract) ReportExists(ctx contractapi.TransactionContextInterface, reportID string) (bool, error) {
	payload, err := ctx.GetStub().GetState(reportID)
	if err != nil {
		return false, fmt.Errorf("failed to read report %s: %w", reportID, err)
	}
	return len(payload) > 0, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&ReportContract{})
	if err != nil {
		panic(fmt.Sprintf("error creating report chaincode: %v", err))
	}

	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("error starting report chaincode: %v", err))
	}
}
