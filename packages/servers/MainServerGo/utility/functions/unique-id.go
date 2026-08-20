package utility_functions

type UniqueId struct {
	CuurentId        string `json:"id" validate:"required"`
	IdInByte         []byte
	ChangeNoOfDigits int `json:"changeNoOfDigits" validate:"required,min=1,max=10"`
	IncreseDigitBy   int `json:"increseDigitBy" validate:"required,min=0,max=9"`
}

var IndexedChar = map[byte]int{
	'A': 0,
	'B': 1,
	'C': 2,
	'D': 3,
	'E': 4,
	'F': 5,
	'G': 6,
	'H': 7,
	'I': 8,
	'J': 9,
	'K': 10,
	'L': 11,
	'M': 12,
	'N': 13,
	'O': 14,
	'P': 15,
	'Q': 16,
	'R': 17,
	'S': 18,
	'T': 19,
	'U': 20,
	'V': 21,
	'W': 22,
	'X': 23,
	'Y': 24,
	'Z': 25,
	'a': 26,
	'b': 27,
	'c': 28,
	'd': 29,
	'e': 30,
	'f': 31,
	'g': 32,
	'h': 33,
	'i': 34,
	'j': 35,
	'k': 36,
	'l': 37,
	'm': 38,
	'n': 39,
	'o': 40,
	'p': 41,
	'q': 42,
	'r': 43,
	's': 44,
	't': 45,
	'u': 46,
	'v': 47,
	'w': 48,
	'x': 49,
	'y': 50,
	'z': 51,
}
var CharArray = []byte("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")

var lenOfCharArray = len(CharArray) - 1

func (u *UniqueId) GetUniqueId() string {
	totalLen := len(u.CuurentId)
	for i := totalLen - u.ChangeNoOfDigits - 1; i < totalLen; i++ {
		if index, ok := IndexedChar[u.IdInByte[i]]; ok {
			index += u.IncreseDigitBy
			if index > lenOfCharArray {
				index = index - lenOfCharArray - 1
			}
			u.IdInByte[i] = CharArray[index]
		}
	}
	u.CuurentId = string(u.IdInByte)
	return u.CuurentId
}

func (u *UniqueId) SetUniqueId(id string) {
	u.CuurentId = id
	u.IdInByte = []byte(u.CuurentId)
}
