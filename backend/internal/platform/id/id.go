package id

import (
	"crypto/rand"
	"encoding/hex"
)

func New(prefix string, hexLength int) string {
	if hexLength < 2 {
		hexLength = 2
	}
	data := make([]byte, (hexLength+1)/2)
	if _, err := rand.Read(data); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return prefix + hex.EncodeToString(data)[:hexLength]
}
