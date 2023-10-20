import acm.program.ConsoleProgram;

public class Pr30 extends ConsoleProgram {
	
	public void run(){
		
		int num = readInt("Enter Number: ");
		Integer b = new Integer(num);
		String numToText = b.toString();
		int length = numToText.length();
		println();
		for(int i=length-1; i>=0; i--){
			
			print(numToText.charAt(i));
			
		}
		
	}

}
